import { Injectable } from '@angular/core';
import { AxelorApiService } from './axelor-api.service';

export type WorkflowType = 'ABANDONED_CHECKOUT';
// A futuro: export type WorkflowType = 'ABANDONED_CHECKOUT' | 'BROWSE_ABANDONMENT';

export interface WorkflowInstance {
  id: number;
  workflowType: WorkflowType;
  name: string;
  active: boolean;
  status?: string;
  agentName?: string;
  followupsCount?: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {

  constructor(private api: AxelorApiService) {}

  async getWorkflowInstances(): Promise<WorkflowInstance[]> {
    const response = await this.api.callAction(
      'com.ajawmrp3.apps.prospectingai.web.WorkflowController:getWorkflowInstances',
      {}
    );
    return response.workflows || [];
  }

  async toggleWorkflowActive(id: number, workflowType: WorkflowType, active: boolean): Promise<void> {
    await this.api.callAction(
      'com.ajawmrp3.apps.prospectingai.web.WorkflowController:toggleWorkflowActive',
      { _id: id, _workflowType: workflowType, _active: active }
    );
  }
}