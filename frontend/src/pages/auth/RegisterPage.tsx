import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage, getFieldErrors } from "../../services/api/errors";

interface FormValues {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
}

const initialValues: FormValues = {
  username: "",
  email: "",
  password: "",
  password_confirm: "",
};

export function RegisterPage() {
  const { register } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const [values, setValues] = useState<FormValues>(initialValues);
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
    const username = values.username.trim();

    if (!username) {
      nextErrors.username = "Choose a username.";
    } else if (username.length > 150) {
      nextErrors.username = "Usernames can be at most 150 characters.";
    } else if (!/^[\w.@+-]+$/.test(username)) {
      nextErrors.username = "Use letters, digits, and @ . + - _ only.";
    }

    if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!values.password) {
      nextErrors.password = "Choose a password.";
    } else if (values.password.length < 8) {
      nextErrors.password = "Passwords must be at least 8 characters.";
    }

    if (!values.password_confirm) {
      nextErrors.password_confirm = "Re-enter your password.";
    } else if (values.password !== values.password_confirm) {
      nextErrors.password_confirm = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await register({
        username,
        email: values.email.trim() || undefined,
        password: values.password,
        password_confirm: values.password_confirm,
      });
      pushToast({
        title: "Workspace ready",
        description: "Upload your first PDF to start a conversation.",
        variant: "success",
      });
      navigate("/", { replace: true });
    } catch (caught) {
      const fieldErrors = getFieldErrors(caught);
      const nonFieldError = fieldErrors.non_field_errors;
      delete fieldErrors.non_field_errors;
      setErrors(fieldErrors);
      setFormError(
        nonFieldError ??
          (Object.keys(fieldErrors).length === 0
            ? getErrorMessage(caught, "We couldn't create your account.")
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
          New workspace
        </p>
        <h1 className="mt-2.5 font-serif text-[36px] leading-[1.06] tracking-[-0.03em] text-ink">
          Create your reading desk.
        </h1>
        <p className="mt-3 text-[13px] leading-5.5 text-muted">
          One account for your documents, citations, and the context you build over time.
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

        <FormField label="Email" htmlFor="email" error={errors.email} optional>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => updateValue("email", event.target.value)}
            invalid={Boolean(errors.email)}
            placeholder="you@example.com"
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Password" htmlFor="password" error={errors.password}>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => updateValue("password", event.target.value)}
              invalid={Boolean(errors.password)}
              placeholder="At least 8 characters"
            />
          </FormField>

          <FormField
            label="Confirm password"
            htmlFor="password_confirm"
            error={errors.password_confirm}
          >
            <PasswordInput
              id="password_confirm"
              name="password_confirm"
              autoComplete="new-password"
              value={values.password_confirm}
              onChange={(event) => updateValue("password_confirm", event.target.value)}
              invalid={Boolean(errors.password_confirm)}
              placeholder="Repeat password"
            />
          </FormField>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? "Creating account…" : "Create account"}
          {!submitting ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
        </Button>
      </form>

      <p className="mt-6 text-center text-[12px] text-muted">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:text-cobalt"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
