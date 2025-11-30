// import { saveAs } from 'file-saver';
import { HttpResponse } from '@angular/common/http';

/**
 * Export file
 * @param resp {resp: HttpResponse<Blob>}
 */
export const exportFile = (resp: HttpResponse<Blob>): void => {
  const filename = getFileName(resp);
  // saveAs(resp.body, filename);
};

export const getFileName = (resp: HttpResponse<Blob>): string => {
  return resp.headers
    .get('content-disposition') // Get the 'content-disposition' header from the response
    .split(';')[1] // Split the header value using a semicolon and select the second part
    .split('=')[1] // Split the second part using an equal sign and select the second part again
    .replace(/"/g, ''); // Remove double quotes from the extracted filename
};
