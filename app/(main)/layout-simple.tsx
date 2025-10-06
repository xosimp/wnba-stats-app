export default function SimpleMainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: '20px', color: 'white', backgroundColor: 'black' }}>
      <h2>Simple Layout</h2>
      {children}
    </div>
  );
}
