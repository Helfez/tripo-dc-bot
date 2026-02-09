import {ModelType} from "./enums";

export declare namespace Model {
  type TaskInfo = {
    task_id: string,
    status?: string,
    type: string,
    name?: string,
    input: TaskInput,
    output?: Output,
    progress?: number,
    create_time: number,
    thumbnail: string,
    result: {
      model: TaskResultType,
      rendered_image: TaskResultType,
      rendered_video: TaskResultType,
    },
    sub_type?: string,
  }
  type Output = {
    model: string,
    rendered_image: string,
    rendered_video?: string,
    riggable?: boolean,
  }
  type TaskInput = {
    file?: {url?: string},
    prompt?: string,
    negative_prompt?: string,
    model_version?: string,
  }
  type TaskResultType = {
    type: string,
    url: string,
  }
  type CreateTextReq = {
    type: ModelType,
    prompt?: string,
    negative_prompt?: string,
    draft_model_task_id?: string,
    original_model_task_id?: string,
    out_format?: string,
    animation?: string,
    render_video?: boolean,
    style?: string,
    format?: string,
    quad?: boolean,
    face_limit?: number,
    file?: {
      type: string,
      file_token: string,
    },
    model_version?: string,
    block_size?: number,
  }
  type CreateTextResult = {
    task_id?: string,
    task_ids?: string[],
    remain_retries?: number,
  }
}