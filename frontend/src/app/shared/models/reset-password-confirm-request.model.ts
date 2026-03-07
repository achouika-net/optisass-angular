export interface IResetPasswordConfirmRequest {
  token: string;
  password: string;
  password_confirmation: string;
}
