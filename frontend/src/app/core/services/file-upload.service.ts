import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UploadResponse {
  url: string;
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
}

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  // Add /api prefix because the backend expects POST /api/uploads when running locally or on server
  private apiUrl = `${environment.apiUrl}/api/uploads`;

  constructor(private http: HttpClient) {}

  uploadFile(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(this.apiUrl, formData);
  }
}
