export interface DOMNode {
  tag: string;
  id: string;
  classes: string;
  text: string;
  selector: string;
  xpath: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children?: DOMNode[];
}

export interface NetworkLog {
  id: string;
  url: string;
  method: string;
  resource_type: string;
  request_headers: Record<string, string>;
  post_data: string | null;
  status: number | null;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  size: number;
}

export type WorkflowAction = 'navigate' | 'click' | 'fill' | 'scroll' | 'extract' | 'extract_list' | 'back' | 'forward' | 'reload' | 'pagination';

export interface WorkflowStep {
  action: WorkflowAction;
  url?: string;
  selector?: string;
  value?: string;
  y?: number;
  name?: string;
  attribute?: string;
  max_pages?: number;
}
