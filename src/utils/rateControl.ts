import {sprintf} from "./index";
import tRedis from "../redis";

export const RATE_CONTROL_PATTERN = "postprocess::rate::control::%s::%s";
export enum RATE_CONTROL_LIMIT {
  DRAFT     = 20,
  IMAGE     = 20,
  PP        = 20,
  ANIMATION = 20,
  REFINE    = 5,
}

export enum TaskType {
  TASK_DRAFT     = "draft",
  TASK_REFINE    = "refine",
  TASK_IMAGE     = "image",
  TASK_PP        = "postprocess/export",
  TASK_ANIMATION = "animation",
}

// Check whether uid reach rate control for task
// draft: 20/1h
// image: 20/1h
// postprocess: 20/1h
// refine: 5/1h
export async function isReachRateControl(uid: string, task: TaskType) {
  let key = sprintf(RATE_CONTROL_PATTERN, uid, `${task}`);
  let rateLimit: number = 0;
  switch (task) {
    case TaskType.TASK_DRAFT:
      rateLimit = RATE_CONTROL_LIMIT.DRAFT;
      break;
    case TaskType.TASK_REFINE:
      rateLimit = RATE_CONTROL_LIMIT.REFINE;
      break;
    case TaskType.TASK_IMAGE:
      rateLimit = RATE_CONTROL_LIMIT.IMAGE;
      break;
    case TaskType.TASK_PP:
      rateLimit = RATE_CONTROL_LIMIT.PP;
      break;
    case TaskType.TASK_ANIMATION:
      rateLimit = RATE_CONTROL_LIMIT.ANIMATION;
      break;
  }

  return await tRedis.checkRateLimit(key, rateLimit);
}
