import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const registerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema)
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        setLocation("/workspaces");
      },
      onError: (err: any) => {
        setError(err?.message || "Failed to register. Please try again.");
      }
    }
  });

  const onSubmit = (data: RegisterFormValues) => {
    setError(null);
    registerMutation.mutate({ data });
  };

  return (
    <div className="min-h-screen flex w-full relative bg-muted/30">
      <img 
        src={`${import.meta.env.BASE_URL}images/auth-bg.png`}
        alt="Abstract background"
        className="absolute inset-0 w-full h-full object-cover opacity-20"
      />
      
      <div className="flex-1 flex items-center justify-center relative z-10 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3 text-primary font-display font-bold text-3xl drop-shadow-sm">
              <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/30">
                <Building2 className="w-8 h-8 text-primary-foreground" />
              </div>
              Growitate
            </div>
          </div>

          <Card className="border-border/60 shadow-xl backdrop-blur-sm bg-card/95 rounded-2xl overflow-hidden">
            <CardHeader className="space-y-2 pb-6">
              <CardTitle className="text-2xl text-center">Create an account</CardTitle>
              <CardDescription className="text-center text-base">
                Join Growitate CRM to manage your clients
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="John Doe" 
                    {...register("name")}
                    className={`h-12 bg-background/50 ${errors.name ? "border-destructive" : ""}`}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    {...register("email")}
                    className={`h-12 bg-background/50 ${errors.email ? "border-destructive" : ""}`}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    {...register("password")}
                    className={`h-12 bg-background/50 ${errors.password ? "border-destructive" : ""}`}
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold rounded-xl hover-elevate shadow-md shadow-primary/20" 
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Sign up"}
                </Button>
              </form>

              <div className="mt-8 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-semibold hover:underline">
                  Log in
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
