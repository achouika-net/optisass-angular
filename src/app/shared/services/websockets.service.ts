import {
  Injectable,
  inject,
  effect,
  signal,
  untracked,
  DestroyRef,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { EMPTY, filter, Subject, timer } from 'rxjs';
import {
  tap,
  switchMap,
  map,
  catchError,
  finalize,
  retry,
  takeUntil,
} from 'rxjs/operators';
import { AppState } from '../../core/store/app.reducers';
import { TenantSelector } from '../../core/store/auth/auth.selectors';
import {
  WebSocketMessage,
  WebSocketResponse,
  MessageHandler,
  Channel,
  ChannelTemplate,
} from '@app/models';
import {
  LOCAL_STORAGE_KEYS,
  PING_INTERVAL,
  WSS_BROADCAST_URL,
  WSS_URL,
} from '@app/config';

/**
 * Configuration des canaux permanents (créés automatiquement)
 * Ajoutez ici tous les canaux qui doivent toujours exister
 */
const DEFAULT_PERMANENT_CHANNELS: ChannelTemplate[] = [
  /*  {
    name: (params: { tenant: string }) => `private-tenant.${params.tenant}`,
    actionType: '[Calendar] Message',
    isPermanent: true,
  },*/
];

@Injectable()
export class WebSocketsService {
  readonly #http = inject(HttpClient);
  readonly #store = inject<Store<AppState>>(Store);
  readonly #destroyRef = inject(DestroyRef);
  tenant = this.#store.selectSignal(TenantSelector);
  #webSocket$: WebSocketSubject<WebSocketMessage>;
  #unsubscribe$ = new Subject<string>();
  #channels = signal<Channel[]>([]);
  #socketId = signal<string | null>(null);
  STORAGE_KEY = LOCAL_STORAGE_KEYS.WSS_CHANNELS;

  constructor() {
    this.#createWebSocketStream();
    this.#initializeChannels();
    this.#setupPing();
    this.#setupAutoPersistence();
    this.#destroyRef.onDestroy(() => {
      console.log('Fermeture de tous les canaux...');
      this.#unsubscribe$.next('all');
      this.#unsubscribe$.complete();
      this.#webSocket$?.complete();
      this.#channels.set([]);
    });
  }

  /**
   * Create the WebSocket connection
   * @private
   */
  #createWebSocketStream() {
    if (!this.#webSocket$) {
      this.#webSocket$ = webSocket<WebSocketMessage>({
        url: `${WSS_URL}`,
        openObserver: {
          next: () => console.log('WebSocket connecté'),
        },
        closeObserver: {
          next: () => console.log('WebSocket fermé'),
        },
      });
    }

    this.#webSocket$
      .pipe(
        retry({ count: Infinity, delay: 5000 }),
        takeUntil(
          this.#unsubscribe$.pipe(
            filter((channel: string) => channel === 'all')
          )
        ),
        tap((m) => {
          const data = this.#parseData<{ socket_id: string }>(m?.data);
          if (data?.socket_id) {
            this.#socketId.set(data?.socket_id);
          }
        })
      )
      .subscribe();
  }

  /**
   * Setup automatic ping to keep the connection alive
   * @private
   */
  #setupPing(): void {
    effect((onCleanup) => {
      const ws = this.#webSocket$;
      if (!ws) return;
      const intervalId = setInterval(() => {
        ws.next({ event: 'pusher:ping' });
      }, PING_INTERVAL);
      onCleanup(() => {
        clearInterval(intervalId);
      });
    });
  }

  /**
   * Setup automatic persistence of channel list to localStorage
   * @private
   */
  #setupAutoPersistence(): void {
    effect(() => {
      const list = this.#channels();
      if (list.length > 0) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    });
  }

  /**
   * Initialize channels from localStorage or defaults
   * @private
   */
  #initializeChannels(): void {
    effect(() => {
      if (!this.#socketId()) {
        return;
      }

      const tenant = this.tenant();

      untracked(() => {
        const stored = localStorage.getItem(this.STORAGE_KEY);

        if (stored) {
          const channels = JSON.parse(stored).map((ch: Channel) => ({
            ...ch,
            isCreated: false,
          }));
          // Filtrer les canaux expirés
          const now = new Date();
          const validChannels = channels.filter((ch: Channel) => {
            if (!ch.expiresAt) return true;
            const expiresAt = new Date(ch.expiresAt);
            return now <= expiresAt;
          });
          this.#channels.set(validChannels);
        } else {
          this.#channels.set(
            DEFAULT_PERMANENT_CHANNELS.map((ch) => ({
              ...ch,
              name: this.#resolveChannelName(ch, { tenant }), // il faut passer tous les params nécessaires ici à titre d'exemple tenant
              isCreated: false,
            }))
          );
        }

        this.#createChannelsFromList();
      });
    });
  }

  /**
   * Create channels based on the current list
   * @private
   */
  #createChannelsFromList(): void {
    const list = this.#channels();
    list.forEach((channel) => {
      this.#createChannel(channel);
    });
  }

  /**
   * Add new channel based on its configuration
   * @param channel Channel configuration
   * @private
   */
  #createChannel(channel: Channel): void {
    const socketId = this.#socketId();
    const channelName = channel.name;
    const expiresAt = new Date(channel?.expiresAt);
    const now = new Date();
    if (channel?.expiresAt && now > expiresAt) {
      console.warn(`Canal ${channelName} expiré avant création`);
      return;
    }
    if (
      this.#channels().some((ch) => ch.name === channelName && ch.isCreated)
    ) {
      console.log(`Canal ${channelName} existe déjà`);
      return;
    }
    let channel$ = this.#http
      .post<{ auth: string }>(`${WSS_BROADCAST_URL}`, {
        socket_id: socketId,
        channel_name: channelName,
      })
      .pipe(
        switchMap((response) => {
          const auth = response.auth;
          return this.#webSocket$.multiplex(
            () => ({
              event: 'pusher:subscribe',
              data: { auth, channel: channelName },
            }),
            () => ({
              event: 'pusher:unsubscribe',
              data: { channel: channelName },
            }),
            (message: WebSocketMessage) => message.channel === channelName
          );
        }),
        takeUntil(
          this.#unsubscribe$.pipe(
            filter((channel) => channel === channelName || channel === 'all')
          )
        ),
        map((message: WebSocketMessage) => {
          const data = this.#parseData(message.data);
          return {
            event: message.event,
            channel: channelName,
            data: data,
          } as WebSocketResponse;
        }),
        tap((message) => {
          const action = this.#createNgrxAction(channel.actionType)(message);
          if (
            action &&
            action.data.event !== 'pusher_internal:subscription_succeeded'
          ) {
            this.#store.dispatch(action);
          }
        }),
        catchError((error) => {
          console.error(`Erreur canal ${channelName}:`, error);
          this.removeChannel(channelName);
          return EMPTY;
        }),
        finalize(() => {
          this.removeChannel(channelName);
        })
      );

    if (channel.expiresAt && !channel.isPermanent) {
      const delay = expiresAt.getTime() - now.getTime();
      const expiration$ = timer(delay).pipe(
        tap(() => {
          console.warn(`Canal ${channelName} expiré`);
          this.removeChannel(channelName);
        })
      );
      channel$ = channel$.pipe(takeUntil(expiration$));
    }

    this.#channels.update((channels) =>
      channels.map((ch: Channel) => {
        if (ch.name === channelName) {
          return { ...ch, isCreated: true };
        } else {
          return ch;
        }
      })
    );

    channel$.subscribe();
  }

  /**
   * create an NgRx action from a WebSocket message
   * @param actionType Type of the action to create
   * @private
   */
  #createNgrxAction(actionType: string): MessageHandler {
    return (message: WebSocketResponse) => ({
      type: actionType,
      data: message,
    });
  }

  /**
   * Retirer un canal
   * @param channelName Nom du canal à retirer
   */
  removeChannel(channelName: string): void {
    this.#channels.update((channels: Channel[]) =>
      channels.filter((ch) => ch.name !== channelName || ch.isPermanent)
    );
    this.#unsubscribe$.next(channelName);
  }

  /**
   * Ajouter un canal temporaire
   * @param channelName Nom du canal à ajouter
   * @param actionType Type d'action à dispatcher pour ce canal
   * @param timeout Durée avant expiration (ms)
   */
  addTemporaryChannel(
    channelName: string,
    actionType: string,
    timeout?: number
  ): void {
    if (
      this.#channels().some(
        (ch: Channel) => ch.name === channelName && ch.isCreated
      )
    ) {
      console.warn(`${channelName} existe déjà dans la liste`);
      return;
    }
    const expiresAt = timeout
      ? new Date(Date.now() + timeout).toISOString()
      : undefined;
    const newChannel: Channel = {
      name: channelName,
      actionType: actionType,
      isPermanent: false,
      isCreated: false,
      expiresAt,
    };

    this.#channels.update((list: Channel[]) => [...list, newChannel]);
    if (this.#socketId()) {
      this.#createChannel(newChannel);
    }
  }

  /**
   * Parser les données reçues
   * @param data
   * @private
   */
  #parseData<T = unknown>(data: unknown): T {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as T;
      } catch (e) {
        console.warn('Erreur parsing JSON:', e);
        return data as T;
      }
    }
    return data as T;
  }

  /**
   * Résoudre le nom d'un canal (statique ou dynamique)
   * @param channel Canal à résoudre
   * @param params Paramètres pour les noms dynamiques
   * @private
   */
  #resolveChannelName(
    channel: ChannelTemplate,
    params?: Record<string, unknown>
  ): string {
    return typeof channel.name === 'function'
      ? channel.name(params)
      : channel.name;
  }
}
