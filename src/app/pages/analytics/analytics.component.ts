import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService, CampaignPerformance, ConversionFunnelStep, SearchActivity } from '../../services/analytics.service';
import { Observable, of } from 'rxjs';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { NgChartsConfiguration, BaseChartDirective } from 'ng2-charts';
import { map } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { TooltipItem } from 'chart.js';

// Importar y registrar componentes de Chart.js
import { Chart, CategoryScale, LinearScale, BarController, BarElement, Tooltip, Legend } from 'chart.js';

Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Tooltip,
  Legend
);

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    BaseChartDirective,
    TranslateModule
  ],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css',
})
export class AnalyticsComponent implements OnInit {
  campaignPerformance$!: Observable<CampaignPerformance[]>;
  conversionFunnel$!: Observable<ConversionFunnelStep[]>;
  searchActivity$!: Observable<SearchActivity[]>;

  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: false,
        title: {
          display: true,
          text: 'Campaña'
        }
      },
      y: {
        stacked: false,
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Tasa (%)'
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
      },
      tooltip: {
        callbacks: {
          label: function(context: TooltipItem<'bar'>) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y + '%';
            }
            return label;
          }
        }
      }
    }
  };
  public barChartLabels: string[] = [];
  public barChartType: ChartType = 'bar';
  public barChartLegend = true;
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  public searchActivityMessage: string | null = null;

  constructor(private analyticsService: AnalyticsService) {}

  ngOnInit() {
    this.analyticsService.getCampaignPerformance().pipe(
      map(campaigns => {
        const labels = campaigns.map(c => c.campaignName);
        const datasets = [
          { data: campaigns.map(c => c.openRate), label: 'Tasa de Apertura', backgroundColor: 'rgba(91, 79, 229, 0.7)', borderColor: 'rgba(91, 79, 229, 1)' },
          { data: campaigns.map(c => c.clickRate), label: 'Tasa de Clics', backgroundColor: 'rgba(255, 159, 64, 0.7)', borderColor: 'rgba(255, 159, 64, 1)' },
          { data: campaigns.map(c => c.replyRate), label: 'Tasa de Respuestas', backgroundColor: 'rgba(75, 192, 192, 0.7)', borderColor: 'rgba(75, 192, 192, 1)' }
        ];

        this.barChartLabels = labels;
        this.barChartData = { labels: labels, datasets: datasets };

        return campaigns;
      })
    ).subscribe(campaigns => {
      // Asignamos el observable procesado a la propiedad para que el HTML pueda seguir usándolo con async pipe si es necesario
      this.campaignPerformance$ = of(campaigns);
    });

    this.conversionFunnel$ = this.analyticsService.getConversionFunnel();
    this.searchActivity$ = this.analyticsService.getSearchActivity().pipe(
      map(data => {
        if (data.length === 0) {
          this.searchActivityMessage = 'No se encontró actividad de búsqueda para tu compañía.';
        } else {
          this.searchActivityMessage = null;
        }
        return data;
      })
    );
  }
}