import { useRouter } from "next/router";
import AuthForm from "@/components/AuthForm";

export default function Login() {
  const router = useRouter();

  const handleLogin = async ({ username, password }) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      const data = await res.json();

      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/dashboard");
    } else {
      alert("Invalid username or password");
    }
  };

  return <AuthForm title="Login" buttonLabel="Login" onSubmit={handleLogin} />;
}
