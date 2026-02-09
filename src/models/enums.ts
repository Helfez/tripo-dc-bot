export enum ModelType {
  Text = 'text_to_model',
  Image = 'image_to_model',
  REFINE = 'refine_model',
  RIG = 'animate_rig',
  RIG_CHECK = 'animate_prerigcheck',
  RETARGET = 'animate_retarget',
  STYLIZE = 'stylize_model',
  CONVERT = 'convert_model',
}

export enum TaskStatus {
  SUCCESS = "success",
  RUNNING = "running",
  QUEUED = "queued",
  FAILED = "failed",
  CANCELLED = "cancelled",
  UNKNOWN = "unknown",
}

export enum Stylize {
  STYLE_LEGO = "lego",
  STYLE_VOXEL = "voxel",
  STYLE_VORONOI = "voronoi",
}

export enum Format {
  FORMAT_FBX = "fbx",
  FORMAT_USD = "usdz",
  FORMAT_OBJ = "obj",
  FORMAT_STL = "stl",
  FORMAT_MINECRAFT = "minecraft",
}
