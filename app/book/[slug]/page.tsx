import BookingClient from "@/components/BookingClient";
export default async function BookingPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <BookingClient slug={slug}/>}
