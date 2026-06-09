import React from 'react'
import Navbar from './Navbar'
import Header from './Header'

const Container = ({ children }) => {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#F4F7FB] overflow-hidden">
      <Navbar />

      <div className="flex-1 bg-[#F4F7FB] p-3 md:p-4 min-w-0 overflow-hidden flex flex-col gap-4">
        <Header />

        <div className="flex-1 w-full overflow-hidden">
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Container