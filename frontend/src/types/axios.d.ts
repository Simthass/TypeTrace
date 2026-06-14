// frontend/src/types/axios.d.ts

import "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipGlobalToast?: boolean;
    skipAuthRedirect?: boolean;
    _retry?: boolean;
  }
}
