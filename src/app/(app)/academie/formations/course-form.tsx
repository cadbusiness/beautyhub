"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCourse, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

const initial: ActionResult = {};

export function CourseForm() {
 const [state, action, pending] = useActionState(createCourse, initial);
 const formRef = useRef<HTMLFormElement>(null);

 useEffect(() => {
 if (state.ok) formRef.current?.reset();
 }, [state.ok]);

 return (
 <form ref={formRef} action={action} className="space-y-4">
 <Field label="Titre" htmlFor="title">
 <Input id="title" name="title" required placeholder="Ma formation" />
 </Field>
 <Field label="Prix (EUR)" htmlFor="price">
 <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue="0" />
 </Field>
 <Field label="Description" htmlFor="description">
 <Textarea id="description" name="description" placeholder="Optionnel" />
 </Field>
 <label className="flex items-center gap-2 text-sm text-slate-700">
 <input type="checkbox" name="is_published" className="rounded border-slate-300" />
 Publier immediatement
 </label>
 {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
 <Button type="submit" disabled={pending}>
 {pending ? "Creation..." : "Creer la formation"}
 </Button>
 </form>
 );
}
