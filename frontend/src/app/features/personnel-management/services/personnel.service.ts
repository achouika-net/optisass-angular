import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Employee, Attendance, Payroll, CommissionRule } from '../../../shared/interfaces/employee.interface';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class PersonnelService {
    private apiUrl = `${environment.apiUrl}/api/personnel`;

    constructor(private http: HttpClient) { }

    // --- Employees ---
    getEmployees(centreId?: string): Observable<Employee[]> {
        return this.http.get<Employee[]>(`${this.apiUrl}/employees`, {
            params: centreId ? { centreId } : {}
        });
    }

    getEmployee(id: string): Observable<Employee> {
        return this.http.get<Employee>(`${this.apiUrl}/employees/${id}`);
    }

    createEmployee(employee: Employee): Observable<Employee> {
        return this.http.post<Employee>(`${this.apiUrl}/employees`, employee);
    }

    updateEmployee(id: string, employee: Partial<Employee>): Observable<Employee> {
        return this.http.patch<Employee>(`${this.apiUrl}/employees/${id}`, employee);
    }

    deleteEmployee(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/employees/${id}`);
    }

    // --- Attendance ---
    logAttendance(attendance: Attendance): Observable<Attendance> {
        return this.http.post<Attendance>(`${this.apiUrl}/attendance`, attendance);
    }

    getMonthlyAttendance(employeeId: string, month: string, year: number): Observable<Attendance[]> {
        return this.http.get<Attendance[]>(`${this.apiUrl}/attendance/${employeeId}`, {
            params: { month, year: year.toString() }
        });
    }

    // --- Commissions ---
    getCommissionRules(centreId?: string): Observable<CommissionRule[]> {
        return this.http.get<CommissionRule[]>(`${this.apiUrl}/commission-rules`, {
            params: centreId ? { centreId } : {}
        });
    }

    createCommissionRule(rule: CommissionRule): Observable<CommissionRule> {
        return this.http.post<CommissionRule>(`${this.apiUrl}/commission-rules`, rule);
    }

    updateCommissionRule(id: string, rule: Partial<CommissionRule>): Observable<CommissionRule> {
        return this.http.patch<CommissionRule>(`${this.apiUrl}/commission-rules/${id}`, rule);
    }

    deleteCommissionRule(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/commission-rules/${id}`);
    }

    getEmployeeCommissions(employeeId: string, mois: string, annee?: number): Observable<any[]> {
        const params: any = { mois };
        if (annee) params.annee = annee.toString();
        return this.http.get<any[]>(`${this.apiUrl}/commissions/${employeeId}`, { params });
    }

    // --- Payroll ---
    getPayrolls(mois?: string, annee?: number, centreId?: string): Observable<Payroll[]> {
        const params: any = {};
        if (mois) params.mois = mois;
        if (annee) params.annee = annee.toString();
        if (centreId) params.centreId = centreId;
        return this.http.get<Payroll[]>(`${this.apiUrl}/payroll`, { params });
    }

    generatePayroll(employeeId: string, mois: string, annee: number): Observable<Payroll> {
        return this.http.post<Payroll>(`${this.apiUrl}/payroll/generate`, { employeeId, mois, annee });
    }

    validatePayroll(id: string): Observable<Payroll> {
        return this.http.post<Payroll>(`${this.apiUrl}/payroll/${id}/validate`, {});
    }

    payPayroll(id: string, centreId: string, userId: string, modePaiement: string, banque?: string, reference?: string, dateEcheance?: Date): Observable<Payroll> {
        return this.http.post<Payroll>(`${this.apiUrl}/payroll/${id}/pay`, { centreId, userId, modePaiement, banque, reference, dateEcheance });
    }

    updatePayroll(id: string, data: any): Observable<Payroll> {
        return this.http.patch<Payroll>(`${this.apiUrl}/payroll/${id}`, data);
    }

    deletePayroll(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/payroll/${id}`);
    }

    getPayrollPdf(id: string): Observable<{ url: string }> {
        return this.http.get<{ url: string }>(`${this.apiUrl}/payroll/${id}/pdf`);
    }

    // --- Payroll Config ---
    getPayrollConfigs(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/payroll-config`);
    }

    getPayrollConfig(annee: number): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/payroll-config/${annee}`);
    }

    createPayrollConfig(config: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/payroll-config`, config);
    }

    updatePayrollConfig(id: string, config: any): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/payroll-config/${id}`, config);
    }

    recordAdvance(employeeId: string, data: { amount: number, mode: string, centreId: string, userId: string }): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/employees/${employeeId}/advance`, data);
    }

    getEmployeeAdvances(employeeId: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/employees/${employeeId}/advances`);
    }

    getDashboardStats(mois?: string, annee?: number, centreId?: string, startDate?: string, endDate?: string): Observable<any> {
        const params: any = { centreId: centreId || '' };
        if (mois) params.mois = mois;
        if (annee) params.annee = annee.toString();
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        return this.http.get<any>(`${this.apiUrl}/dashboard/stats`, { params });
    }
}
