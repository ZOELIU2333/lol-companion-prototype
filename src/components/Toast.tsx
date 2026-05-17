type ToastProps = {
  message: string
}

export function Toast({ message }: ToastProps) {
  return <div className="toast" role="status">{message}</div>
}
