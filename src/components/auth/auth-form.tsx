"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { useT } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";

type AuthFormProps = {
  type: "login" | "signup";
};

export function AuthForm({ type }: AuthFormProps) {
  const t = useT();
  const isSignup = type === "signup";

  const formSchema = z.object({
    email: z.string().email({ message: t.auth.validation.email }),
    password: z.string().min(8, { message: t.auth.validation.password }),
    companyName: z.string().optional(),
  });
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      companyName: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    // Here you would call your authentication logic
  }

  return (
    <Card className="w-full max-w-md shadow-2xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          <Logo />
        </div>
        <CardTitle className="font-headline text-3xl">
          {isSignup ? t.auth.signupTitle : t.auth.loginTitle}
        </CardTitle>
        <CardDescription>
          {isSignup
            ? t.auth.signupDescription
            : t.auth.loginDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {isSignup && (
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.auth.companyNameLabel}</FormLabel>
                    <FormControl>
                      <Input placeholder={t.auth.companyNamePlaceholder} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.auth.emailLabel}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t.auth.emailPlaceholder}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.auth.passwordLabel}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={t.auth.passwordPlaceholder} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              {isSignup ? t.auth.signupButton : t.auth.loginButton}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {isSignup ? t.auth.alreadyHaveAccount : t.auth.dontHaveAccount}{" "}
          <Button variant="link" asChild className="p-0">
            <Link href={isSignup ? "/login" : "/signup"}>
              {isSignup ? t.auth.loginButton : t.auth.signupButton}
            </Link>
          </Button>
        </p>
      </CardFooter>
    </Card>
  );
}
