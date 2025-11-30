import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/authentication.component').then((cmp) => cmp.AuthenticationComponent),
    children: [
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
      {
        path: 'login',
        loadComponent: () =>
          import('./components/login/login.component').then((cmp) => cmp.LoginComponent),
      },
      // {
      //   path: 'forgot',
      //   loadComponent: () =>
      //     import('./components/forgot-password/forgot-password.component').then(
      //       (cmp) => cmp.ForgotPasswordComponent
      //     ),
      // },
      // {
      //   path: 'reset/:token',
      //   loadComponent: () =>
      //     import('./components/reset-password/reset-password.component').then(
      //       (cmp) => cmp.ResetPasswordComponent
      //     ),
      // },
    ],
  },
];
