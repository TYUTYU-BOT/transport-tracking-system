import { useRouter } from "next/router";
import AuthForm from "@/components/AuthForm";

export default function Signup() {
  const router = useRouter();

  const handleSignup = async ({ username, password }) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      alert("Account created!");
      router.push("/login");
    } else {
      alert("User already exists");
    }
  };

  return <AuthForm title="Sign Up" buttonLabel="Sign Up" onSubmit={handleSignup} />;
}
