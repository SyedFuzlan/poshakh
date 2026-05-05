export default function AnnouncementBar() {
  const items = [
    "✦  FREE SHIPPING ON ALL ORDERS",
    "✦  HANDCRAFTED IN HYDERABAD",
  ];

  const repeated = [...items, ...items, ...items, ...items, ...items, ...items];

  return (
    <div
      className="bg-poshakh-maroon text-poshakh-varwhite overflow-hidden whitespace-nowrap relative z-[1000] flex items-center"
      style={{ height: "26px" }}
    >
      <div
        className="animate-[marquee_30s_linear_infinite] flex"
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
