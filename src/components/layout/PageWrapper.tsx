import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';

export type PageWrapperProps = {
    children: React.ReactNode;
    className?: string;
};

export const PageWrapper = ({ children, className }: PageWrapperProps) => (
    <BackgroundGradientAnimation
        interactive={false}
        // className={cn(
        //     'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-purple-900',
        //     className,
        // )}
    >
        {children}
    </BackgroundGradientAnimation>
);
