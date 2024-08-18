with wave.open(wavfile, "rb") as wav:                                                                                              
    # load frames                                                                                                                  
    raw_wav= wav.readframes(wav.getnframes())                                                                                      
    # downsample                                                                                                                   
    raw_wav_8khz, st = audioop.ratecv(raw_wav,2,1,24000,8000,None)                                                                 
    # to explain the above:                                                                                                        
    #  2: sample depth in bytes                                                                                                    
    #  1: number of channels                                                                                                       
    #  24000: samplerate                                                                                                           
    #  8000: desired samplerate                                                                                                    
                                                                                                                                   
    # convert to mulaw                                                                                                             
    raw_ulaw = audioop.lin2ulaw(raw_wav_8khz,wav.getsampwidth()) 