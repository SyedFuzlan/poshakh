"use client";
import { useEffect, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";

export default function AnnouncementBar() {
  const [text, setText] = useState("✦ FREE SHIPPING ON ALL ORDERS");

  useEffect(() => {
    fetch(`${BACKEND}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.announcement_text) {
          setText(`✦ ${data.announcement_text.toUpperCase()}`);
        }
      })
      .catch(() => {});
  }, []);

  const repeated = Array(12).fill(text);

  return (
    <div
      className="bg-zohra-maroon text-zohra-varwhite overflow-hidden whitespace-nowrap relative z-[1000] flex items-center"
      style={{ height: "26px" }}
    >
      <div
        className="animate-[marquee_40s_linear_infinite] flex"
        style={{ width: "max-content" }}
      >
        {repeated.map((item, i) => (
          <span
            key={i}
            style={{ fontSize: "10px", letterSpacing: "0.22em", fontWeight: 500, paddingRight: "120px" }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
