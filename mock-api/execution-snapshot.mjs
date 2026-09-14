export function snapshotGroupExecution(group) {
  return {
    group_id: group.id,
    group_revision: group.revision,
    medication: structuredClone(group.medication || null),
    surveys: structuredClone(group.surveys || []),
    tasks: structuredClone(group.tasks || []),
    reminder: structuredClone(group.reminder || null),
    pickup_remind_time: group.pickup_remind_time || "",
    pickup_requirements: group.pickup_requirements || "",
  };
}

export function executionSnapshotFor(db, patient) {
  return db.patientExecutionSnapshots?.find(
    (row) => row.user_id === patient.id,
  );
}
