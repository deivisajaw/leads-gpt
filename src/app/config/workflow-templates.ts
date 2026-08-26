import { WorkflowType } from '../services/workflow.service';

export interface WorkflowTemplate {
  key: WorkflowType;
  icon: string;
  titleKey: string;
  descriptionKey: string;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'ABANDONED_CHECKOUT',
    icon: 'fa-cart-shopping',
    titleKey: 'WORKFLOWS.TEMPLATE.ABANDONED_CHECKOUT.TITLE',
    descriptionKey: 'WORKFLOWS.TEMPLATE.ABANDONED_CHECKOUT.DESCRIPTION'
  }
  // Cuando agregues un nuevo template fijo:
  // {
  //   key: 'BROWSE_ABANDONMENT',
  //   icon: 'fa-eye',
  //   titleKey: 'WORKFLOWS.TEMPLATE.BROWSE_ABANDONMENT.TITLE',
  //   descriptionKey: 'WORKFLOWS.TEMPLATE.BROWSE_ABANDONMENT.DESCRIPTION'
  // }
];