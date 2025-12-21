export interface LoginFormModel {
  email: string;
  password: string;
}

export const LOGIN_FORM_INITIAL_VALUE: LoginFormModel = {
  email: '',
  password: '',
};
