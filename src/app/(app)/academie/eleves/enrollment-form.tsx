"use client";

import { useActionState, useEffect, useRef } from "react";
import { createEnrollment, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

interface CourseOption {
  id: string;
  title: string;
}

interface ClientOption {
  id: string;
  full_name: string | null;
  email: string;
}

interface EnrollmentFormProps {
  courses: CourseOption[];
  clients: ClientOption[];
}

export function EnrollmentForm({ courses, clients }: EnrollmentFormProps) {
  const [state, action, pending] = useActionState(createEnrollment, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  if (courses.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Creez d&apos;abord une formation avant d&apos;inscrire un eleve.
      </p>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label="Formation" htmlFor="course_id">
        <select
          id="course_id"
          name="course_id"
          required
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Choisir...</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nom de l'eleve" htmlFor="student_name">
        <Input id="student_name" name="student_name" required placeholder="Marie Durand" />
      </Field>
      <Field label="Email" htmlFor="student_email">
        <Input
          id="student_email"
          name="student_email"
          type="email"
          required
          placeholder="marie@email.com"
        />
      </Field>
      {clients.length > 0 ? (
        <Field label="Lier a un client (optionnel)" htmlFor="client_id">
          <select
            id="client_id"
            name="client_id"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Aucun</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name ?? c.email} ({c.email})
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Inscription..." : "Inscrire l'eleve"}
      </Button>
    </form>
  );
}
