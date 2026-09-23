import { emptySubmissionConfirmation } from "./submissionConfirmationState";

export default function SubmissionConfirmation({ value = emptySubmissionConfirmation, onChange, disabled = false }) {
  const updateValue = (field, checked) => {
    onChange?.({ ...emptySubmissionConfirmation, ...value, [field]: checked });
  };

  return (
    <div style={styles.root}>
      <label style={styles.item}>
        <input
          type="checkbox"
          checked={Boolean(value.detailsVerified)}
          onChange={(event) => updateValue("detailsVerified", event.target.checked)}
          disabled={disabled}
          style={styles.checkbox}
        />
        <span>
          I have verified all the details and confirm that the information provided is correct. I am responsible for the accuracy of this data.
        </span>
      </label>

      <label style={{ ...styles.item, ...styles.requiredItem }}>
        <input
          type="checkbox"
          checked={Boolean(value.documentsUploaded)}
          onChange={(event) => updateValue("documentsUploaded", event.target.checked)}
          disabled={disabled}
          style={styles.checkbox}
        />
        <span>
          I confirm that <strong>all required supporting documents and attachments have been uploaded</strong> against the respective entries. I understand that <strong>any missing or false attachment is my sole responsibility</strong> and may result in the rejection or revision of my appraisal.
        </span>
      </label>
    </div>
  );
}

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
  },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "14px 16px",
    border: "1px solid #d7dee9",
    borderRadius: 8,
    background: "var(--bg)",
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.5,
    cursor: "pointer",
  },
  requiredItem: {
    borderColor: "var(--green-200)",
    background: "var(--green-50)",
  },
  checkbox: {
    width: 16,
    height: 16,
    marginTop: 2,
    flex: "0 0 auto",
    cursor: "pointer",
  },
};
