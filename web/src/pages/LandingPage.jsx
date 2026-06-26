import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, Route, Calendar, CreditCard, Smartphone } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const onGetStarted = () => navigate('/login');

  return (
    <div className="bg-gray-50 text-gray-800">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-brand">E-Transport</h1>
          <button onClick={onGetStarted} className="bg-brand text-white font-bold py-2 px-5 rounded-lg hover:bg-brand-dark transition-colors">
            Login
          </button>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="text-center py-20 px-6 bg-brand text-white">
          <h2 className="text-5xl font-extrabold mb-4">Streamline Your Transport Services Effortlessly</h2>
          <p className="text-lg max-w-3xl mx-auto mb-8 text-brand-light opacity-90">
            Manage your fleet, track your vehicles in real-time, and provide a seamless experience for your passengers. E-Transport is the all-in-one solution for modern transport management.
          </p>
          <button onClick={onGetStarted} className="bg-white text-brand font-bold py-3 px-8 rounded-lg text-lg hover:bg-gray-100 transition-transform transform hover:scale-105">Login & Get Started</button>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-6">
          <div className="container mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12">Key Features</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { icon: MapPin, title: "Real-Time Tracking", description: "Monitor your entire fleet on a live map, ensuring safety and punctuality for passengers and administrators." },
                { icon: Users, title: "Passenger Management", description: "Easily manage passenger lists, pickup/dropoff locations, and handle communications seamlessly." },
                { icon: Route, title: "Dynamic Route Planning", description: "Drivers can define and update their routes, optimizing for efficiency and adapting to new passengers." },
                { icon: Calendar, title: "Availability & Booking", description: "Passengers can mark absences and book extra seats, with real-time availability updates for everyone." },
                { icon: CreditCard, title: "Automated Billing", description: "Simplify your finances with clear, automated monthly billing and easy-to-manage bank details for drivers." },
                { icon: Smartphone, title: "Web & Mobile Access", description: "Access the platform from anywhere, with a powerful web dashboard for admins and dedicated mobile apps for drivers and passengers." }
              ].map(feature => (
                <div key={feature.title} className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
                  <div className="bg-brand-light text-brand p-3 rounded-full inline-block mb-4">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="bg-white py-20 px-6">
          <div className="container mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-10">Get started with a full-featured free trial. No credit card required.</p>
            <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-md mx-auto border-2 border-brand">
              <h3 className="text-2xl font-bold text-gray-900">Monthly Plan</h3>
              <p className="text-5xl font-extrabold text-brand my-4">
                LKR 6,000.00
                <span className="text-lg font-medium text-gray-500">/per vehicle /month</span>
              </p>
              <p className="bg-yellow-100 text-yellow-800 font-semibold px-4 py-2 rounded-full inline-block mb-6">
                Your first <strong>7 days are completely free</strong>. No commitments.
              </p>
              <ul className="text-left space-y-3 text-gray-700 mb-8">
                {[
                  "Unlimited Passenger Accounts",
                  "Unlimited Trips",
                  "Real-Time GPS Tracking",
                  "Mobile Apps for Drivers & Passengers",
                  "Web Dashboard for Admins",
                  "Email & Phone Support"
                ].map(item => (
                  <li key={item} className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    {item}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full bg-brand text-white font-bold py-3 px-8 rounded-lg text-lg hover:bg-brand-dark transition-transform transform hover:scale-105">
                Start Your Free Trial
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto text-center">
          <p>&copy; 2026 E-Transport. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

const CheckCircle = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

export default LandingPage;