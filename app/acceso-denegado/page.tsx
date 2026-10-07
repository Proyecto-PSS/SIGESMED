"use client";

import { useClerk } from "@clerk/nextjs";

export default function AccesoDenegadoPage() {
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    await signOut({
      redirectUrl: "/sign-in",
    });
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f1f5f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "500px",
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          padding: "32px",
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
        }}
      >
        <h1
          style={{
            color: "#000000",
            fontSize: "32px",
            fontWeight: "700",
            marginBottom: "16px",
          }}
        >
          Acceso denegado
        </h1>

        <p
          style={{
            color: "#000000",
            fontSize: "16px",
            marginBottom: "24px",
          }}
        >
          Tu usuario está autenticado, pero no tiene un rol válido
          configurado para acceder al sistema.
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          style={{
            backgroundColor: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "12px 20px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}