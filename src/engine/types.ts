export type NodeId = string;
export type EdgeId = string;
export type PortId = string;

export type Point = {
  x: number;
  y: number;
};

export type Port = {
  id: PortId;
  label: string;
};

export type BaseNode = {
  id: NodeId;
  position: Point;
  label: string;
};

export type StartNode = BaseNode & {
  type: "start";
  outputs: Port[];
};

export type ActionNode = BaseNode & {
  type: "action";
  inputs: Port[];
  outputs: Port[];
  config: {
    action: string;
  };
};

export type ConditionNode = BaseNode & {
  type: "condition";
  inputs: Port[];
  outputs: Port[];
  config: {
    expression: string;
  };
};

export type EndNode = BaseNode & {
  type: "end";
  inputs: Port[];
};

export type WorkflowNode =
  | StartNode
  | ActionNode
  | ConditionNode
  | EndNode;

export type WorkflowEdge = {
  id: EdgeId;
  source: {
    nodeId: NodeId;
    portId: PortId;
  };
  target: {
    nodeId: NodeId;
    portId: PortId;
  };
};

export type Workflow = {
  id: string;
  version: 1;
  name?: string;
  description?: string;
  nodes: Record<NodeId, WorkflowNode>;
  edges: Record<EdgeId, WorkflowEdge>;
};
