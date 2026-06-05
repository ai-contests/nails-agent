import * as React from "react"
import { X } from "lucide-react"

const Dialog = ({ open, onOpenChange, children }: { open: boolean, onOpenChange: (open: boolean) => void, children: React.ReactNode }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-ink/50 backdrop-blur-sm transition-opacity" 
        onClick={() => onOpenChange(false)}
      />
      {/* Content */}
      <div className="relative z-50 bg-white rounded-card shadow-lg w-full max-w-3xl overflow-hidden p-0">
        {children}
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 p-2 bg-black/10 hover:bg-black/20 rounded-full text-white backdrop-blur-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export { Dialog }
