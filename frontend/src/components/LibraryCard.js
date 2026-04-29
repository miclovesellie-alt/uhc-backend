import React from "react";

function LibraryCard({ resource, onClick }) {
  return (
    <div className="library-card" onClick={onClick} style={styles.card}>
      <img
        src={resource.thumbnail}
        alt={resource.title}
        style={styles.thumbnail}
      />
      <div style={styles.info}>
        <h3 style={styles.title}>{resource.title}</h3>
        <p style={styles.type}>Type: {resource.type}</p>
        <p style={styles.description}>{resource.description}</p>
      </div>
    </div>
  );
}

const styles = {
  card: {
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "1rem",
    cursor: "pointer",
    width: "200px",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  thumbnail: {
    width: "100%",
    height: "120px",
    objectFit: "cover",
    borderRadius: "4px",
  },
  info: {
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
  },
  title: {
    fontSize: "1rem",
    fontWeight: "bold",
  },
  type: {
    fontSize: "0.8rem",
    color: "#555",
  },
  description: {
    fontSize: "0.8rem",
    color: "#777",
  },
};

export default LibraryCard;
