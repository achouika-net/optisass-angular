export interface ILoginRequest {
  email: string;
  password: string;
}

export const LOGIN_REQUEST_INITIAL_VALUE: ILoginRequest = {
  email: '',
  password: '',
};
