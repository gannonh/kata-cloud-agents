export function buildExecutorPrompt(
  taskTitle: string,
  taskDescription: string,
  taskIndex: number,
  totalTasks: number,
): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `You are an Executor agent. You are executing task ${taskIndex + 1} of ${totalTasks}.

Your job is to complete the task described by the user using the available tools:
- shell_exec: Run shell commands
- file_read: Read files
- file_write: Write files
- git_clone: Clone repositories
- git_commit: Stage and commit changes
- git_diff: View changes

Work methodically:
1. Read relevant files to understand context
2. Make the necessary changes
3. Verify your changes work (run tests if applicable)
4. Commit your changes with a clear message

When done, summarize what you did and any decisions you made.`;

  const userMessage = `Task: ${taskTitle}\n\nDescription: ${taskDescription}`;

  return { systemPrompt, userMessage };
}
