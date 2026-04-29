import React from "react";
import { useParams } from "react-router-dom";

function TopicPage() {
  const { topic } = useParams();

  // Temporary documents (later these will come from the backend)
  const documents = [
    {
      name: "Human Skeleton.pdf",
      url: "/documents/human-skeleton.pdf",
    },
    {
      name: "Brain Structure.pdf",
      url: "/documents/brain-structure.pdf",
    },
    {
      name: "Cardiovascular Notes.pdf",
      url: "/documents/cardiovascular.pdf",
    },
  ];

  return (
    <div style={{ padding: "40px" }}>
      <h1>{topic.toUpperCase()}</h1>

      <h3 style={{ marginTop: "30px" }}>Documents</h3>

      <div style={{ marginTop: "20px" }}>
        {documents.map((doc, index) => (
          <div
            key={index}
            style={{
              padding: "12px",
              border: "1px solid #ddd",
              marginBottom: "10px",
              borderRadius: "6px",
            }}
          >
            <a href={doc.url} target="_blank" rel="noreferrer">
              {doc.name}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TopicPage;