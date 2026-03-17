export type BoardNodeType = 'entry' | 'textbox' | 'image' | 'shape'

export type ShapeKind = 'rectangle' | 'square' | 'circle' | 'oval' | 'cloud'

export interface RumourBoard {
  id: string
  investigation_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface BoardNode {
  id: string
  board_id: string
  node_type: BoardNodeType
  position_x: number
  position_y: number
  width: number | null
  height: number | null
  data_json: string
  created_at: string
}

export interface BoardEdge {
  id: string
  board_id: string
  source_node_id: string
  target_node_id: string
  label: string | null
  style_json: string | null
}

export interface BoardViewport {
  x: number
  y: number
  zoom: number
}

export interface BoardState {
  board: RumourBoard
  nodes: BoardNode[]
  edges: BoardEdge[]
  viewport: BoardViewport
}
