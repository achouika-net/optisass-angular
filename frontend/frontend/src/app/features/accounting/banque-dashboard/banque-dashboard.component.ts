import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BanqueService } from '../services/banque.service';
import { MatTableModule } from '@angular/material/table';

@Component({
  selector: 'app-banque-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatTableModule],
  templateUrl: './banque-dashboard.component.html',
  styleUrls: ['./banque-dashboard.component.css']
})
export class BanqueDashboardComponent implements OnInit {
  comptes: any[] = [];
  rapprochementData: any = null;

  constructor(private banqueService: BanqueService) {}

  ngOnInit() {
    this.loadComptes();
    this.loadRapprochement();
  }

  loadComptes() {
    this.banqueService.getComptes().subscribe(res => this.comptes = res);
  }

  loadRapprochement() {
    this.banqueService.getRapprochement().subscribe(res => this.rapprochementData = res);
  }

  onFileSelected(event: any, compteId: string) {
    const file = event.target.files[0];
    if (file) {
      this.banqueService.importReleve(compteId, file).subscribe(() => {
        alert('Relevé importé avec succès !');
        this.loadComptes();
        this.loadRapprochement();
      });
    }
  }

  validerMatch(transactionId: string, typeMatched: string, matchedId: string) {
    this.banqueService.validerRapprochement(transactionId, typeMatched, matchedId).subscribe(() => {
      this.loadRapprochement();
    });
  }
}
