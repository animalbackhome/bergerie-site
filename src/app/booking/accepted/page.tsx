export default function BookingAcceptedPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>✅ Demande acceptée</h1>
      <p>Merci. La demande a bien été marquée comme <b>acceptée</b>.</p>
      <p style={{ marginTop: 12, color: "#555" }}>
        Vous pouvez maintenant répondre au voyageur par e-mail pour finaliser.
      </p>
    </main>
  );
}
