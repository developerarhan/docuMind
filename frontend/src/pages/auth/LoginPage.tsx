import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage, getFieldErrors } from "../../services/api/errors";

interface LocationState {
  from?: string;
}

interface FormValues {
  username: string;
  password: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const returnTo = state?.from && state.from !== "/login" ? state.from : "/";

  const [values, setValues] = useState<FormValues>({ username: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateValue = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!values.username.trim()) nextErrors.username = "Enter your username.";
    if (!values.password) nextErrors.password = "Enter your password.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFormError(null);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await login({ username: values.username.trim(), password: values.password });
      pushToast({ title: "Welcome back", variant: "success" });
      navigate(returnTo, { replace: true });
    } catch (caught) {
      const fieldErrors = getFieldErrors(caught);
      const nonFieldError = fieldErrors.non_field_errors;
      delete fieldErrors.non_field_errors;
      setErrors(fieldErrors);
      setFormError(
        nonFieldError ??
          (Object.keys(fieldErrors).length === 0
            ? getErrorMessage(caught, "We couldn't sign you in.")
            : null),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.17em] text-cobalt">
          Welcome back
        </p>
        <h1 className="mt-2.5 font-serif text-[36px] leading-[1.06] tracking-[-0.03em] text-ink">
          Sign in to your desk.
        </h1>
        <p className="mt-3 text-[13px] leading-5.5 text-muted">
          Pick up where you left off with your documents and conversations.
        </p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-4" noValidate>
        {formError ? <Alert>{formError}</Alert> : null}

        <FormField label="Username" htmlFor="username" error={errors.username}>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={values.username}
            onChange={(event) => updateValue("username", event.target.value)}
            invalid={Boolean(errors.username)}
            placeholder="your-username"
            data-autofocus
          />
        </FormField>

        <FormField label="Password" htmlFor="password" error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(event) => updateValue("password", event.target.value)}
            invalid={Boolean(errors.password)}
            placeholder="Enter your password"
          />
        </FormField>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
          {!submitting ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
        </Button>
      </form>

      <p className="mt-6 text-center text-[12px] text-muted">
        New to DocuMind?{" "}
        <Link
          to="/register"
          className="font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:text-cobalt"
        >
          Create an account
        </Link>
      </p>

      <p className="mt-8 border-t border-line pt-4 text-center text-[10.5px] leading-4 text-faint">
        Your documents are private. Every session is authenticated and scoped to your
        account.
      </p>
    </AuthLayout>
  );
}
