// import { saveAs } from 'file-saver';
import { HttpResponse } from '@angular/common/http';

/**
 * Export file
 * @param resp {resp: HttpResponse<Blob>}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const exportFile = (_resp: HttpResponse<Blob>): void => {
  // TODO: Uncomment when file-saver is installed
  // const filename = getFileName(_resp);
  // saveAs(_resp.body, filename);
};

export const getFileName = (resp: HttpResponse<Blob>): string => {
  return resp.headers
    .get('content-disposition') // Get the 'content-disposition' header from the response
    .split(';')[1] // Split the header value using a semicolon and select the second part
    .split('=')[1] // Split the second part using an equal sign and select the second part again
    .replace(/"/g, ''); // Remove double quotes from the extracted filename
};
