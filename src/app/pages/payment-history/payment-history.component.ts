import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common'; 
import { CompanyDataService } from '../../services/company-data.service'; 
import { DecimalPipe } from '@angular/common';
import jsPDF from 'jspdf'; 
import { InfoModalComponent } from '../../components/shared/info-modal/info-modal.component'; 

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [TranslateModule, CommonModule, InfoModalComponent],
  providers: [DecimalPipe],
  templateUrl: './payment-history.component.html',
  styleUrl: './payment-history.component.css'
})
export class PaymentHistoryComponent implements OnInit {
  historyData: any[] = [];
  isLoading = true;
  error: string | null = null;

  showInfoModal: boolean = false; 
  infoModalMessage: string = ''; 

  constructor(private companyDataService: CompanyDataService, private decimalPipe: DecimalPipe) { }

  openInfoModal(details: string): void {
    this.infoModalMessage = details;
    this.showInfoModal = true;
  }

  closeInfoModal(): void {
    this.showInfoModal = false;
  }

  ngOnInit(): void {
    this.loadHistory();
  }

  async loadHistory(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const response = await this.companyDataService.getSubscriptionHistory();
      this.historyData = response.history || [];
    } catch (err: any) {
      this.error = err.message || 'Failed to load payment history.';
    } finally {
      this.isLoading = false;
    }
  }

  downloadInvoice(record: any): void {
    const doc = new jsPDF();
    let y = 15; // Initial Y position
    let currentX = 14; // Declare currentX here, at method scope

    const tableColWidths = [60, 40, 30, 40]; // Name, Price, Qty, Subtotal
    const tableHeaders = ['PLAN NAME', 'PRICE/UNIT', 'USERS', 'SUBTOTAL']; // Declared at method scope

    // --- Header Section ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text('INVOICE', 14, y);
    y += 10;
    doc.setFontSize(12);
    doc.text('AjawAI', 14, y);
    y += 15;

    // --- Issued To / Invoice Details Section ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Issued To (Left)
    doc.text('ISSUED TO:', 14, y);
    doc.setFont('helvetica', 'bold');
    doc.text(record.clientName || 'N/A', 14, y + 5); // Use dynamic client name
    doc.setFont('helvetica', 'normal');
    doc.text(record.email || 'N/A', 14, y + 10); // Use dynamic client email
    
    // Invoice Details (Right)
    doc.text('Invoice ID:', 150, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${record.id}`, 175, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('Date:', 150, y + 5);
    doc.text(`${new Date(record.eventDate).toLocaleDateString()}`, 175, y + 5, { align: 'right' });
    
    y += 30; // Move Y down after this section

    // --- Membership Dates Section ---
    doc.setFont('helvetica', 'bold');
    doc.text('MEMBERSHIP DATES:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Start Date: ${new Date(record.startDate).toLocaleDateString() || 'N/A'}`, 14, y + 5);
    doc.text(`End Date: ${new Date(record.endDate).toLocaleDateString() || 'N/A'}`, 14, y + 10);
    y += 20;

    // --- Table Header ---
    const tableStartY = y + 10;
    const col1X = 14; // PLAN NAME (left)
    const col2X = col1X + 60; // PRICE/UNIT (right aligned to this point)
    const col3X = col2X + 40; // USERS (right aligned to this point)
    const col4X = col3X + 30; // SUBTOTAL (right aligned to this point)
    const tableWidth = 182; // Total width of the table

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setFillColor(240, 240, 240); // Light gray background for header
    doc.rect(14, tableStartY, tableWidth, 10, 'F'); // Draw header background

    // Reset currentX for header drawing
    currentX = 14; 
    doc.text('PLAN NAME', col1X, tableStartY + 7);
    doc.text('PRICE/UNIT', col2X + 35, tableStartY + 7, { align: 'right' }); // Adjust X for right alignment
    doc.text('USERS', col3X + 25, tableStartY + 7, { align: 'right' }); // Adjust X for right alignment
    doc.text('SUBTOTAL', col4X + 35, tableStartY + 7, { align: 'right' }); // Adjust X for right alignment
    y = tableStartY + 10; // Update Y to be below header

    // --- Table Row (Single Record) ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    currentX = 14; // Reset currentX for row drawing
    const parsedAmount = parseFloat(record.amount || '0'); // Parse amount to number
    const subtotal = parsedAmount * (record.userNumbers || 1); // Calculate subtotal

    doc.text(record.planName || 'N/A', currentX, y + 7);
    doc.text(`$${this.formatNumberWithCommas(parsedAmount)}`, col2X + 35, y + 7, { align: 'right' }); // Use parsedAmount
    doc.text(`${record.userNumbers || 'N/A'}`, col3X + 25, y + 7, { align: 'right' });
    doc.text(`$${this.formatNumberWithCommas(subtotal)}`, col4X + 35, y + 7, { align: 'right' });
    y += 10; // Move Y down after row

    // --- Totalizer ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', 170, y + 10, { align: 'right' });
    doc.text(`$${this.formatNumberWithCommas(subtotal)}`, 190, y + 10, { align: 'right' });
    y += 20;

    // --- Footer (Optional) ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Thank you for your business!', 14, doc.internal.pageSize.height - 10);

    // Save the PDF
    doc.save(`invoice-${record.id}.pdf`);
  }

  formatNumberWithCommas(amount: number): string {
    return this.decimalPipe.transform(amount, '1.0-2')!;
  }
}