import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignalWithTransform,
  output,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { IStatisticCardData, IStatisticCardDataExtras } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';

const transformStatisticsCards = (statisticsCardsData: IStatisticCardData[]) =>
  statisticsCardsData.map(
    (statisticCardData: IStatisticCardData) =>
      ({
        ...statisticCardData,
        extras: statisticCardData.extras?.filter((extra: IStatisticCardDataExtras) => !extra.hide),
      } as IStatisticCardData)
  );
@Component({
  selector: 'app-statistic-card',
  templateUrl: './statistic-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, MatCardModule, MatIconModule],
})
export class StatisticCardComponent {
  statisticsCardsData: InputSignalWithTransform<IStatisticCardData[], IStatisticCardData[]> = input(
    [],
    { transform: transformStatisticsCards }
  );
  cardClick = output<number>();
}
