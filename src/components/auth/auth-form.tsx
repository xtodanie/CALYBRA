"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";

import { useT, useLocale } from "@/i18n/provider";
import { useAuth } from "@/hooks/use-auth";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type AuthFormProps = {
  type: "login" | "signup";
};

type FormValues = {
  email: string;
  password: string;
  companyName?: string;
};

export function AuthForm({ type }: AuthFormProps) {
  const t = useT();
  const locale = useLocale();
  const isSignup = type === "signup";
  const { login, signup, provisioningError, retryProvisioning } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const baseSchema = z.object({
    email: z.string().email({ message: t.auth.validation.email }),
    password: z.string().min(8, { message: t.auth.validation.password }),
  });
  const formSchema: z.ZodType<FormValues> = isSignup
    ? baseSchema.extend({
        companyName: z.string().min(1, { message: t.auth.validation.companyName }),
      })
    : baseSchema;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      companyName: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    try {
      if (isSignup) {
        await signup(values.email, values.password, values.companyName ?? "");
      } else {
        await login(values.email, values.password);
      }
      router.push(`/${locale}/month-closes`);
    } catch (error) {
      const err = error as FirebaseError;
      let message = t.auth.errors.default;
      if (err.code === 'auth/email-already-in-use') {
        message = t.auth.errors.emailInUse;
      } else if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/invalid-login-credentials' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-email'
      ) {
        message = t.auth.errors.invalidCredentials;
      }
      toast({
        variant: "destructive",
        title: t.auth.errors.title,
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
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
        {provisioningError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>{t.auth.errors.title}</AlertTitle>
            <AlertDescription>
              {t.auth.errors.default}
              <Button
                type="button"
                variant="link"
                className="ml-2 h-auto p-0"
                onClick={retryProvisioning}
              >
                {t.auth.provisioning.retry}
              </Button>
            </AlertDescription>
          </Alert>
        )}
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="animate-spin" />}
              {isSignup ? t.auth.signupButton : t.auth.loginButton}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {isSignup ? t.auth.alreadyHaveAccount : t.auth.dontHaveAccount}{" "}
          <Button variant="link" asChild className="p-0">
            <Link href={isSignup ? `/${locale}/login` : `/${locale}/signup`}>
              {isSignup ? t.auth.loginButton : t.auth.signupButton}
            </Link>
          </Button>
        </p>
      </CardFooter>
    </Card>
  );
}
