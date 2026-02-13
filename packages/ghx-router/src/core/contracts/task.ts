export type TaskId = string

export interface TaskRequest<TInput = Record<string, unknown>> {
  task: TaskId
  input: TInput
}
