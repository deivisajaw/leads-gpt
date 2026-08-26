import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx'; 
    
@Injectable({
    providedIn: 'root'
})
export class ExportService {
    
    constructor() { }
    
    /**
    * Exporta un array de objetos a un archivo CSV.
    * @param data El array de objetos a exportar.
    * @param filename El nombre del archivo (sin extensión).
   */
   
    exportToCsv(data: any[], filename: string): void {
        if (!data || data.length === 0) {
            console.warn('No hay datos para exportar a CSV.');
            return;
        }
    
        const header = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).map(value => `"${value}"`).join(','));
        const csvContent = `${header}\n${rows.join('\n')}`;
    
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { // Feature detection
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
   
    /**
    * Exporta un array de objetos a un archivo Excel (XLSX).
    * @param data El array de objetos a exportar.
    * @param filename El nombre del archivo (sin extensión).
    */
    exportToExcel(data: any[], filename: string): void {
        if (!data || data.length === 0) {
            console.warn('No hay datos para exportar a Excel.');
            return;
        }
   
        const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
        const wb: XLSX.WorkBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1'); 
   
        XLSX.writeFile(wb, `${filename}.xlsx`);
    }
}