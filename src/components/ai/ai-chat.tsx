"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import {
  X,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const chatTransport = new DefaultChatTransport({
  api: "/api/ai/chat",
});

const DISCOVERED_KEY = "affarskoll:ai-chat-discovered";

export function AiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [hasDiscovered, setHasDiscovered] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Discovery: visa pulse + tooltip första gången tills användaren öppnat chatten
  useEffect(() => {
    try {
      const flag = localStorage.getItem(DISCOVERED_KEY);
      setHasDiscovered(flag === "1");
    } catch {
      // localStorage kan saknas (SSR/incognito)
    }
  }, []);

  function markDiscovered() {
    setHasDiscovered(true);
    try {
      localStorage.setItem(DISCOVERED_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  const { messages, sendMessage, status, setMessages, error } = useChat({
    transport: chatTransport,
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["vat-events"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-packages"] });
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleClear = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      sendMessage({ text: input.trim() });
      setInput("");
    },
    [input, isLoading, sendMessage]
  );

  const handleSuggestion = useCallback(
    (text: string) => {
      sendMessage({ text });
    },
    [sendMessage]
  );

  // Ctrl/Cmd + J to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* FAB button */}
      <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[100]">
        {/* Discovery tooltip — visas tills användaren öppnat AI:n första gången */}
        {!hasDiscovered && !isOpen && (
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-popover border rounded-lg shadow-lg px-3 py-2 text-xs animate-in fade-in slide-in-from-right-2 duration-300">
            <p className="font-medium">🤖 AI-assistent</p>
            <p className="text-muted-foreground">Tryck här eller ⌘J</p>
            <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-popover border-t-0 border-l-0 border" />
          </div>
        )}
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) markDiscovered();
          }}
          className={cn(
            "relative w-12 h-12 rounded-full shadow-lg",
            "flex items-center justify-center transition-all duration-200",
            "hover:scale-105 active:scale-95",
            isOpen
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground",
            !hasDiscovered && !isOpen && "animate-pulse"
          )}
          aria-label={isOpen ? "Stäng AI-assistent" : "Öppna AI-assistent"}
        >
          {isOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          {!hasDiscovered && !isOpen && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-amber-400 border-2 border-background rounded-full" />
          )}
        </button>
      </div>

      {/* Chat panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-36 right-4 lg:bottom-20 lg:right-6 z-[100]",
            "w-[calc(100vw-2rem)] max-w-md",
            "bg-background border rounded-xl shadow-2xl",
            "flex flex-col overflow-hidden",
            "animate-in slide-in-from-bottom-4 fade-in duration-200"
          )}
          style={{ maxHeight: "min(600px, calc(100vh - 12rem))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">AI-assistent</p>
                <p className="text-[10px] text-muted-foreground">
                  Ctrl+J att öppna/stänga
                </p>
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs h-7"
              >
                Rensa
              </Button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Hej! Jag kan hjälpa dig med:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>Skapa nya uppdrag och projekt</li>
                    <li>Lägga till uppdrag i portföljen</li>
                    <li>Registrera arbetstid</li>
                    <li>Svara på frågor om beläggning</li>
                  </ul>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                  {[
                    "Visa min beläggning",
                    "Nytt uppdrag för Acme",
                    "Logga 8h idag",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestion(suggestion)}
                      className="px-2.5 py-1 text-xs rounded-full border hover:bg-muted transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2.5",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.parts?.map((part, i) => {
                    if (part.type === "text" && part.text) {
                      return (
                        <p key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      );
                    }
                    if (
                      part.type &&
                      typeof part.type === "string" &&
                      part.type.startsWith("tool-")
                    ) {
                      const p = part as any;
                      const toolName = p.type.replace("tool-", "");
                      const isResult = p.state === "output-available" || p.state === "output-error";
                      const isSuccess = p.state === "output-available" && p.output?.success;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 text-xs py-1 opacity-70"
                        >
                          {isResult ? (
                            isSuccess ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                            )
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                          <span>
                            {toolName === "createProject" &&
                              "Skapar uppdrag..."}
                            {toolName === "addToPortfolio" &&
                              "Lägger till i portföljen..."}
                            {toolName === "logTime" && "Registrerar tid..."}
                            {toolName === "getPortfolioSummary" &&
                              "Hämtar portföljdata..."}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })}
                  {/* Empty message fallback */}
                  {(!message.parts || message.parts.length === 0) && (
                    <p className="text-muted-foreground text-xs">...</p>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                </div>
                <div className="bg-destructive/10 rounded-xl px-3 py-2 text-sm text-destructive">
                  <p>Något gick fel. Försök igen.</p>
                  {error?.message && (
                    <p className="text-xs mt-1 opacity-70">{error.message}</p>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 p-3 border-t bg-background"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Skriv ett meddelande..."
              className="flex-1 min-w-0 bg-muted rounded-lg px-3 py-2 text-base md:text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
