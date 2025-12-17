import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { NestedTreeControl } from '@angular/cdk/tree';
import { Router, RouterModule } from '@angular/router';
import { GroupsService } from '../../../groups/services/groups.service';

interface StockNode {
    id: string;
    name: string;
    type: 'GROUP' | 'CENTER' | 'WAREHOUSE';
    children?: StockNode[];
    data?: any; // Original data object
}

@Component({
    selector: 'app-stock-hierarchy',
    standalone: true,
    imports: [
        CommonModule,
        MatTreeModule,
        MatIconModule,
        MatButtonModule,
        MatProgressBarModule,
        MatCardModule,
        RouterModule
    ],
    templateUrl: './stock-hierarchy.component.html',
    styleUrls: ['./stock-hierarchy.component.scss']
})
export class StockHierarchyComponent implements OnInit {
    treeControl = new NestedTreeControl<StockNode>(node => node.children);
    dataSource = new MatTreeNestedDataSource<StockNode>();
    loading = false;

    constructor(
        private groupsService: GroupsService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.loadHierarchy();
    }

    loadHierarchy(): void {
        this.loading = true;
        this.groupsService.findAll().subscribe({
            next: (groups: any[]) => {
                this.dataSource.data = this.transformData(groups);
                this.loading = false;
                // Expand all by default for visibility
                this.dataSource.data.forEach(node => this.treeControl.expand(node));
            },
            error: (err) => {
                console.error('Error loading hierarchy:', err);
                this.loading = false;
            }
        });
    }

    transformData(groups: any[]): StockNode[] {
        return groups.map(group => ({
            id: group.id,
            name: group.nom,
            type: 'GROUP',
            data: group,
            children: (group.centres || []).map((center: any) => ({
                id: center.id,
                name: center.nom,
                type: 'CENTER',
                data: center,
                children: (center.entrepots || []).map((warehouse: any) => ({
                    id: warehouse.id,
                    name: warehouse.nom,
                    type: 'WAREHOUSE',
                    data: warehouse,
                    children: [] as StockNode[] // Warehouses are leaves
                }))
            }))
        }));
    }

    hasChild = (_: number, node: StockNode) => !!node.children && node.children.length > 0;

    onNodeClick(node: StockNode): void {
        if (node.type === 'WAREHOUSE') {
            this.router.navigate(['/p/warehouses', node.id]);
        } else {
            // Toggle expansion
            if (this.treeControl.isExpanded(node)) {
                this.treeControl.collapse(node);
            } else {
                this.treeControl.expand(node);
            }
        }
    }

    getIcon(type: string): string {
        switch (type) {
            case 'GROUP': return 'domain'; // or 'business_center'
            case 'CENTER': return 'store';
            case 'WAREHOUSE': return 'inventory_2';
            default: return 'folder';
        }
    }
}
