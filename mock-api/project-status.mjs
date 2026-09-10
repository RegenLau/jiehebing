export function effectiveProjectStatus(project, date) {
  if (!project || project.manual_ended_at) return 2;
  if (date < project.start_date) return 0;
  if (date > project.end_date) return 2;
  return 1;
}

export function projectStatusView(project, date) {
  const status = effectiveProjectStatus(project, date);
  return {
    ...structuredClone(project),
    status,
    status_source: project.manual_ended_at ? 'manual' : 'date'
  };
}
